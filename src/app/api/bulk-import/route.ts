export const maxDuration = 60
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sanitizeText,
  sanitizePhone,
  sanitizeEmail,
  generateDeterministicNoPhone,
} from '@/lib/sanitize'

function mergeNotes(newNotes?: string | null, existingNotes?: string | null): string | null {
  const n = (newNotes || '').trim()
  const e = (existingNotes || '').trim()
  if (!n) return e || null
  if (!e) return n || null
  if (e.includes(n)) return e
  if (n.includes(e)) return n
  return `${n} | ${e}`
}

// ---------------------------------------------------------------------------
// POST /api/bulk-import
// Accepts a JSON body: { patients: ImportPatient[] }
// Returns: { success, inserted, updated, skipped, appointmentsInserted, errors }
//
// DEDUPLIKACIJSKA LOGIKA:
//   1. Pacijenti SA chart_number → dedup po chart_number (lookup u DB)
//   2. Pacijenti BEZ chart_number SA telefonom → dedup po telefonu:
//       - Isti telefon, isto ime → ažuriraj
//       - Isti telefon, različito ime → dodaj sufiks -deljen- (porodica)
//   3. Pacijenti BEZ chart_number BEZ telefona → dedup po determinističkom ključu
//       (ime+prezime+roditelj → hash), a zatim i po imenu u bazi (lookup)
//       NEMA više kreiranja duplikata sa Date.now() sufiksom!
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Neautorizovan pristup.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const patients: any[] = body.patients || []

    if (patients.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, updated: 0, skipped: 0, appointmentsInserted: 0, errors: [] })
    }

    const SUB_BATCH = 50
    let insertedCount = 0
    let updatedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    // 2. Format & normalize all patients
    const formattedPatients = patients.map((p: any) => {
      const fName = sanitizeText(p.first_name) || 'Nepoznato'
      const lName = sanitizeText(p.last_name) || null
      const rawChart = sanitizeText(p.chart_number)
      const chartNum = rawChart ? rawChart.trim() : null
      const parent = sanitizeText(p.parent_name) || null

      let phoneVal = sanitizePhone(p.phone)
      const hasRealPhone = Boolean(phoneVal && phoneVal !== '/' && !phoneVal.startsWith('/'))

      if (!hasRealPhone) {
        // UVEK deterministički ključ — NIKAD Math.random() ovde!
        phoneVal = generateDeterministicNoPhone(fName, lName, chartNum, parent)
      }

      const validCategories = ['regular', 'implant', 'proteza']

      return {
        first_name: fName,
        last_name: lName,
        phone: phoneVal,
        hasRealPhone,
        email: sanitizeEmail(p.email) || null,
        parent_name: parent,
        medical_alerts: sanitizeText(p.medical_alerts) || null,
        notes: sanitizeText(p.notes) || null,
        category: validCategories.includes(p.category) ? p.category : 'regular',
        chart_number: chartNum,
        appointment_date: p.appointment_date || null,
        doctor_name: sanitizeText(p.doctor_name) || null,
      }
    })

    // 3. Deduplicate within this batch (by chart_number, real phone, or deterministic key)
    const dedupMap = new Map<string, typeof formattedPatients[0]>()
    const uniquePatients: typeof formattedPatients = []

    for (const p of formattedPatients) {
      let dedupKey: string
      if (p.chart_number) {
        dedupKey = `chart:${p.chart_number.toLowerCase().trim()}`
      } else if (p.hasRealPhone) {
        dedupKey = `phone:${p.phone.trim()}:${p.first_name.toLowerCase().trim()}`
      } else {
        dedupKey = `key:${p.phone}` // za no-phone pacijente, p.phone je već deterministički slug-hash ključ
      }

      if (dedupMap.has(dedupKey)) {
        const prev = dedupMap.get(dedupKey)!
        prev.notes = mergeNotes(p.notes, prev.notes)
        if (!prev.email && p.email) prev.email = p.email
        if (!prev.parent_name && p.parent_name) prev.parent_name = p.parent_name
        if (!prev.medical_alerts && p.medical_alerts) prev.medical_alerts = p.medical_alerts
        if (p.category !== 'regular') prev.category = p.category
        if (!prev.appointment_date && p.appointment_date) {
          prev.appointment_date = p.appointment_date
          prev.doctor_name = p.doctor_name
        }
        continue
      }
      dedupMap.set(dedupKey, p)
      uniquePatients.push(p)
    }

    // 4. Batch DB lookups — BOTH by chart_number AND by deterministic phone key
    const chartsToLookup = Array.from(new Set(
      uniquePatients.filter(p => Boolean(p.chart_number)).map(p => p.chart_number!.trim())
    ))
    const noPhoneKeysToLookup = Array.from(new Set(
      uniquePatients.filter(p => !p.hasRealPhone).map(p => p.phone)
    ))

    // Lookup by chart_number
    const existingByChart = new Map<string, any>()
    for (let i = 0; i < chartsToLookup.length; i += 200) {
      const batch = chartsToLookup.slice(i, i + 200)
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, phone, email, parent_name, medical_alerts, notes, category, chart_number')
        .in('chart_number', batch)
      if (error) {
        console.error('[bulk-import] Error looking up charts:', error.message)
      } else if (data) {
        data.forEach((p: any) => {
          if (p.chart_number) existingByChart.set(p.chart_number.toLowerCase().trim(), p)
        })
      }
    }

    // Lookup by deterministic phone key (no-phone patients)
    const existingByDetPhone = new Map<string, any>()
    for (let i = 0; i < noPhoneKeysToLookup.length; i += 200) {
      const batch = noPhoneKeysToLookup.slice(i, i + 200)
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, phone, email, parent_name, medical_alerts, notes, category, chart_number')
        .in('phone', batch)
      if (error) {
        console.error('[bulk-import] Error looking up no-phone keys:', error.message)
      } else if (data) {
        data.forEach((p: any) => {
          if (p.phone) existingByDetPhone.set(p.phone, p)
        })
      }
    }

    // Lookup by real phone (for patients WITH phone but without chart_number)
    const realPhonesToLookup = Array.from(new Set(
      uniquePatients.filter(p => p.hasRealPhone && !p.chart_number).map(p => p.phone)
    ))
    const existingByPhone = new Map<string, any>()
    for (let i = 0; i < realPhonesToLookup.length; i += 200) {
      const batch = realPhonesToLookup.slice(i, i + 200)
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, phone, email, parent_name, medical_alerts, notes, category, chart_number')
        .in('phone', batch)
      if (error) {
        console.error('[bulk-import] Error looking up real phones:', error.message)
      } else if (data) {
        data.forEach((p: any) => {
          if (p.phone) existingByPhone.set(p.phone, p)
        })
      }
    }

    // 5. Upsert / Insert / Skip loop
    const chartToId = new Map<string, string>()
    const patientIdMap = new WeakMap<object, string>()

    for (let i = 0; i < uniquePatients.length; i += SUB_BATCH) {
      const batch = uniquePatients.slice(i, i + SUB_BATCH)

      for (const p of batch) {
        const chartKey = p.chart_number ? p.chart_number.toLowerCase().trim() : null

        // ── Path A: patient has chart_number ──────────────────────────────
        if (chartKey) {
          const existing = existingByChart.get(chartKey)

          if (existing) {
            // UPDATE — matched by chart_number
            const phoneToKeep = p.hasRealPhone
              ? p.phone
              : (existing.phone && !existing.phone.startsWith('/-no-phone-') ? existing.phone : p.phone)

            const updatePayload: Record<string, any> = {
              first_name: p.first_name || existing.first_name,
              last_name: p.last_name ?? existing.last_name,
              phone: phoneToKeep,
              chart_number: p.chart_number,
              email: p.email ?? existing.email,
              parent_name: p.parent_name ?? existing.parent_name,
              medical_alerts: p.medical_alerts ?? existing.medical_alerts,
              notes: mergeNotes(p.notes, existing.notes),
              category: (p.category && p.category !== 'regular') ? p.category : (existing.category || 'regular'),
              updated_at: new Date().toISOString(),
            }

            const { error: updateErr } = await supabase
              .from('patients').update(updatePayload).eq('id', existing.id)

            if (updateErr) {
              errors.push(`Ažuriranje (${p.first_name}): ${updateErr.message}`)
            } else {
              updatedCount++
              patientIdMap.set(p, existing.id)
              chartToId.set(chartKey, existing.id)
            }
          } else {
            // INSERT — new chart_number not in DB
            const { data: newRow, error: insertErr } = await supabase
              .from('patients')
              .insert({
                first_name: p.first_name, last_name: p.last_name,
                phone: p.phone, email: p.email, parent_name: p.parent_name,
                medical_alerts: p.medical_alerts, notes: p.notes,
                category: p.category, chart_number: p.chart_number,
              })
              .select('id, phone, chart_number')
              .single()

            if (insertErr) {
              if (insertErr.code === '23505') {
                // Kolizija u bazi (chart_number ili telefon) — proveri oba
                const { data: sameCh } = await supabase.from('patients')
                  .select('id, first_name, last_name, chart_number, notes, phone')
                  .ilike('chart_number', p.chart_number!).maybeSingle()

                if (sameCh) {
                  const { error: upErr } = await supabase.from('patients')
                    .update({
                      notes: mergeNotes(p.notes, sameCh.notes),
                      phone: p.hasRealPhone ? p.phone : sameCh.phone,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', sameCh.id)
                  if (!upErr) {
                    updatedCount++
                    patientIdMap.set(p, sameCh.id)
                    chartToId.set(chartKey, sameCh.id)
                    existingByChart.set(chartKey, sameCh)
                  } else {
                    errors.push(`Kolizija kartona (${p.first_name}): ${upErr.message}`)
                  }
                } else {
                  const { data: samePh } = await supabase.from('patients')
                    .select('id, first_name, last_name, chart_number, notes')
                    .eq('phone', p.phone).maybeSingle()
                  if (samePh) {
                    const { error: upErr } = await supabase.from('patients')
                      .update({
                        chart_number: p.chart_number,
                        notes: mergeNotes(p.notes, samePh.notes),
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', samePh.id)
                    if (!upErr) {
                      updatedCount++
                      patientIdMap.set(p, samePh.id)
                      chartToId.set(chartKey, samePh.id)
                      existingByChart.set(chartKey, samePh)
                    } else {
                      errors.push(`Kolizija telefona (${p.first_name}): ${upErr.message}`)
                    }
                  } else {
                    skippedCount++
                  }
                }
              } else {
                errors.push(`Unos (${p.first_name}): ${insertErr.message}`)
              }
            } else if (newRow) {
              insertedCount++
              patientIdMap.set(p, newRow.id)
              chartToId.set(chartKey, newRow.id)
              existingByChart.set(chartKey, newRow)
            }
          }

        // ── Path B: patient has REAL phone, no chart_number ───────────────
        } else if (p.hasRealPhone) {
          const existingByPh = existingByPhone.get(p.phone)

          if (existingByPh) {
            const isSameName =
              existingByPh.first_name.trim().toLowerCase() === p.first_name.trim().toLowerCase() &&
              (existingByPh.last_name || '').trim().toLowerCase() === (p.last_name || '').trim().toLowerCase()

            if (isSameName) {
              // Isti pacijent → AŽURIRAJ (ne dupliraj)
              const { error: upErr } = await supabase.from('patients').update({
                email: p.email ?? existingByPh.email,
                parent_name: p.parent_name ?? existingByPh.parent_name,
                medical_alerts: p.medical_alerts ?? existingByPh.medical_alerts,
                notes: mergeNotes(p.notes, existingByPh.notes),
                category: (p.category && p.category !== 'regular') ? p.category : existingByPh.category,
                updated_at: new Date().toISOString(),
              }).eq('id', existingByPh.id)
              if (!upErr) {
                updatedCount++
                patientIdMap.set(p, existingByPh.id)
              } else {
                errors.push(`Ažuriranje (${p.first_name}): ${upErr.message}`)
              }
            } else {
              // Drugi pacijent, isti telefon (porodica) → INSERT sa -deljen- sufiksom
              const famSuffix = Math.random().toString(36).replace(/[^a-z]/g, '').substring(0, 4) || 'fam'
              const sharedPhone = `${p.phone}-deljen-${famSuffix}`
              const { data: newRow, error: insErr } = await supabase.from('patients')
                .insert({
                  first_name: p.first_name, last_name: p.last_name,
                  phone: sharedPhone, email: p.email, parent_name: p.parent_name,
                  medical_alerts: p.medical_alerts,
                  notes: mergeNotes(p.notes, `Deli tel sa: ${existingByPh.first_name} ${existingByPh.last_name || ''}`),
                  category: p.category, chart_number: null,
                })
                .select('id').single()
              if (insErr) {
                errors.push(`Deljeni tel (${p.first_name}): ${insErr.message}`)
              } else if (newRow) {
                insertedCount++
                patientIdMap.set(p, newRow.id)
              }
            }
          } else {
            // Novi pacijent sa novim telefonom → INSERT
            const { data: newRow, error: insErr } = await supabase.from('patients')
              .insert({
                first_name: p.first_name, last_name: p.last_name,
                phone: p.phone, email: p.email, parent_name: p.parent_name,
                medical_alerts: p.medical_alerts, notes: p.notes,
                category: p.category, chart_number: null,
              })
              .select('id').single()

            if (insErr) {
              if (insErr.code === '23505') {
                // Kolizija telefona u bazi (uneti u prethodnom batchu ili trka)
                const { data: existPh } = await supabase.from('patients')
                  .select('id, first_name, last_name, phone, notes, email')
                  .eq('phone', p.phone).maybeSingle()
                if (existPh) {
                  const { error: upErr } = await supabase.from('patients').update({
                    notes: mergeNotes(p.notes, existPh.notes),
                    email: p.email ?? existPh.email,
                    updated_at: new Date().toISOString(),
                  }).eq('id', existPh.id)
                  if (!upErr) {
                    updatedCount++
                    patientIdMap.set(p, existPh.id)
                    existingByPhone.set(p.phone, existPh)
                  } else {
                    errors.push(`Ažuriranje (${p.first_name}): ${upErr.message}`)
                  }
                } else {
                  skippedCount++
                }
              } else {
                errors.push(`Unos (${p.first_name}): ${insErr.message}`)
              }
            } else if (newRow) {
              insertedCount++
              patientIdMap.set(p, newRow.id)
              existingByPhone.set(p.phone, { id: newRow.id, first_name: p.first_name, last_name: p.last_name, phone: p.phone })
            }
          }

        // ── Path C: patient has NO phone AND NO chart_number ──────────────
        } else {
          // Deterministički ključ je već u p.phone (slug-hash od imena)
          let existingByKey = existingByDetPhone.get(p.phone)

          // Ako nije nađen po tačnom hash ključu, pokušaj po imenu i prezimenu među no-phone pacijentima
          // (ovo pronalazi pacijente iz starih uvoza koji imaju stari nasumični format ili timestamp sufiks)
          if (!existingByKey && p.first_name && p.first_name !== 'Nepoznato') {
            let nameQuery = supabase
              .from('patients')
              .select('id, first_name, last_name, phone, email, parent_name, medical_alerts, notes, category, chart_number')
              .like('phone', '/-no-phone-%')
              .ilike('first_name', p.first_name.trim())

            if (p.last_name) {
              nameQuery = nameQuery.ilike('last_name', p.last_name.trim())
            } else {
              nameQuery = nameQuery.is('last_name', null)
            }
            if (p.parent_name) {
              nameQuery = nameQuery.ilike('parent_name', p.parent_name.trim())
            }

            const { data: nameMatch } = await nameQuery.limit(1).maybeSingle()
            if (nameMatch) {
              existingByKey = nameMatch
              existingByDetPhone.set(p.phone, nameMatch)
            }
          }

          if (existingByKey) {
            // Isti deterministički ključ ili isto ime bez telefona → isti pacijent → AŽURIRAJ
            // Normalizuj phone na čist deterministički ključ p.phone ako je u bazi bio stari sufiks
            const { error: upErr } = await supabase.from('patients').update({
              phone: p.phone,
              email: p.email ?? existingByKey.email,
              parent_name: p.parent_name ?? existingByKey.parent_name,
              medical_alerts: p.medical_alerts ?? existingByKey.medical_alerts,
              notes: mergeNotes(p.notes, existingByKey.notes),
              category: (p.category && p.category !== 'regular') ? p.category : existingByKey.category,
              updated_at: new Date().toISOString(),
            }).eq('id', existingByKey.id)
            if (!upErr) {
              updatedCount++
              patientIdMap.set(p, existingByKey.id)
              existingByDetPhone.set(p.phone, { ...existingByKey, phone: p.phone })
            } else {
              errors.push(`Ažuriranje (${p.first_name}): ${upErr.message}`)
            }
          } else {
            // Nije nađen → INSERT
            const { data: newRow, error: insErr } = await supabase.from('patients')
              .insert({
                first_name: p.first_name, last_name: p.last_name,
                phone: p.phone, email: p.email, parent_name: p.parent_name,
                medical_alerts: p.medical_alerts, notes: p.notes,
                category: p.category, chart_number: null,
              })
              .select('id').single()

            if (insErr) {
              if (insErr.code === '23505') {
                // Kolizija ključa u bazi → pronađi i ažuriraj bez kreiranja duplikata
                const { data: existByKey2 } = await supabase.from('patients')
                  .select('id, notes, email, parent_name, medical_alerts, category')
                  .eq('phone', p.phone).maybeSingle()
                if (existByKey2) {
                  const { error: upErr2 } = await supabase.from('patients').update({
                    notes: mergeNotes(p.notes, existByKey2.notes),
                    email: p.email ?? existByKey2.email,
                    updated_at: new Date().toISOString(),
                  }).eq('id', existByKey2.id)
                  if (!upErr2) {
                    updatedCount++
                    patientIdMap.set(p, existByKey2.id)
                    existingByDetPhone.set(p.phone, existByKey2)
                  } else {
                    errors.push(`Kolizija (${p.first_name}): ${upErr2.message}`)
                  }
                } else {
                  skippedCount++
                }
              } else {
                errors.push(`Unos (${p.first_name}): ${insErr.message}`)
              }
            } else if (newRow) {
              insertedCount++
              patientIdMap.set(p, newRow.id)
              existingByDetPhone.set(p.phone, newRow)
            }
          }
        }
      }
    }

    // 6. Handle appointments
    let appointmentsInserted = 0
    const patientsWithAppointments = uniquePatients.filter(p => p.appointment_date)

    if (patientsWithAppointments.length > 0) {
      const patientIdsForAppts: string[] = []
      for (const p of patientsWithAppointments) {
        const chartKey = p.chart_number ? p.chart_number.toLowerCase().trim() : null
        const id = patientIdMap.get(p) ?? (chartKey ? chartToId.get(chartKey) : undefined)
        if (id) patientIdsForAppts.push(id)
      }

      const existingApptKeys = new Set<string>()
      for (let i = 0; i < patientIdsForAppts.length; i += 100) {
        const batchIds = patientIdsForAppts.slice(i, i + 100)
        const { data: existingAppts } = await supabase
          .from('appointments')
          .select('patient_id, appointment_datetime')
          .in('patient_id', batchIds)
        if (existingAppts) {
          for (const a of existingAppts) {
            existingApptKeys.add(`${a.patient_id}::${String(a.appointment_datetime).substring(0, 10)}`)
          }
        }
      }

      const appointmentsToInsert: any[] = []
      for (const p of patientsWithAppointments) {
        const chartKey = p.chart_number ? p.chart_number.toLowerCase().trim() : null
        const patientId = patientIdMap.get(p) ?? (chartKey ? chartToId.get(chartKey) : undefined)
        if (!patientId || !p.appointment_date) continue
        const dayKey = `${patientId}::${String(p.appointment_date).substring(0, 10)}`
        if (existingApptKeys.has(dayKey)) continue
        appointmentsToInsert.push({
          patient_id: patientId,
          appointment_datetime: p.appointment_date,
          doctor_name: p.doctor_name || null,
          treatment_today: 'Uvezen termin',
          treatment_history: [],
          reminder_sent: false,
        })
        existingApptKeys.add(dayKey)
      }

      for (let i = 0; i < appointmentsToInsert.length; i += SUB_BATCH) {
        const batch = appointmentsToInsert.slice(i, i + SUB_BATCH)
        const { error: apptErr } = await supabase.from('appointments').insert(batch)
        if (apptErr) {
          errors.push(`Termini: ${apptErr.message}`)
        } else {
          appointmentsInserted += batch.length
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      appointmentsInserted,
      errors,
    })
  } catch (err) {
    console.error('[bulk-import] Unexpected:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: `Neočekivana greška: ${msg}` },
      { status: 500 }
    )
  }
}
