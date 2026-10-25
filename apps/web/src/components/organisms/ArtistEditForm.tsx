import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Button, Chip, Switch, Text } from '@/components/atoms'
import { BottomSheet } from '@/components/molecules'
import { changedLinks, compactPhoto, labelLines, lines, parseLabelLines } from '@/lib/perreo-edit'
import { KIND_OPTIONS, LINK_FIELDS, STATUS_LABELS, STYLE_OPTIONS, kindName, type LinkKey, type PerreoArtistFull, type PerreoArtistPatch } from '@/lib/perreo-types'
import { cn } from '@/lib/utils'

interface ArtistEditFormProps {
  open: boolean
  artist: PerreoArtistFull
  ownSongs: { videoId: string; title: string }[]
  /** Foto actual (para la vista previa). */
  photoUrl: string
  saving?: boolean
  error?: string | null
  onSave: (patch: PerreoArtistPatch) => void
  onClose: () => void
}

/** Un campo con su etiqueta; `text-base` evita el zoom automático de iOS al enfocar. */
function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {children(id)}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

const inputClass = 'min-h-11 w-full min-w-0 rounded-md border-[1.5px] border-border bg-background px-3 text-base text-foreground outline-none focus:border-ring'
const Input = (props: ComponentProps<'input'>) => <input {...props} className={cn(inputClass, props.className)} />

/** Reduce una foto elegida a 400 px y la pasa a WebP en el propio móvil (pesa unos 30 KB). Devuelve base64 sin cabecera. */
async function toWebpBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 400
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, 0, side, side, 0, 0, 400, 400)
  return compactPhoto((type, quality) => canvas.toDataURL(type, quality))
}

/** Formulario para corregir un artista a mano: hoja inferior en el móvil. Lo editado no lo pisa ninguna recarga. */
export function ArtistEditForm({ open, artist, ownSongs, photoUrl, saving, error, onSave, onClose }: ArtistEditFormProps) {
  const [name, setName] = useState(artist.name)
  const [nickname, setNickname] = useState(artist.nickname ?? '')
  const [kind, setKind] = useState(artist.kind)
  const [country, setCountry] = useState(artist.country ?? '')
  const [city, setCity] = useState(artist.city ?? '')
  const [year, setYear] = useState(artist.debutYear ? String(artist.debutYear) : '')
  const [styles, setStyles] = useState(artist.styles)
  const [extraStyle, setExtraStyle] = useState('')
  const [labels, setLabels] = useState(labelLines(artist.labels))
  const [bio, setBio] = useState(artist.bio ?? '')
  const [links, setLinks] = useState(Object.fromEntries(LINK_FIELDS.map((f) => [f.key, artist.links[f.key] ?? ''])) as Record<LinkKey, string>)
  const [fame, setFame] = useState(Math.round(artist.fame))
  const [street, setStreet] = useState(artist.streetLevel ?? null)
  const [listeners, setListeners] = useState(artist.listeners != null ? String(artist.listeners) : '')
  const [realName, setRealName] = useState(artist.realName ?? '')
  const [birthDate, setBirthDate] = useState(artist.birthDate ?? '')
  const [status, setStatus] = useState(artist.status ?? '')
  const [until, setUntil] = useState(artist.activeUntil ? String(artist.activeUntil) : '')
  const [aliases, setAliases] = useState((artist.aliases ?? []).join('\n'))
  const [collaborators, setCollaborators] = useState((artist.collaborators ?? []).join('\n'))
  const [channel, setChannel] = useState(artist.youtubeChannelId ?? '')
  const [color, setColor] = useState(artist.manualFields?.includes('color') ? (artist.color ?? '') : '')
  const [photoLink, setPhotoLink] = useState('')
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [photoNote, setPhotoNote] = useState<string | null>(null)
  const [featured, setFeatured] = useState(artist.featuredVideoId ?? '')
  const [featuredLink, setFeaturedLink] = useState('')
  const [hidden, setHidden] = useState(artist.hidden ?? false)

  const allStyles = [...new Set([...STYLE_OPTIONS, ...styles])]
  const toggleStyle = (s: string) => setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  const addStyle = () => {
    const s = extraStyle.trim().toLowerCase()
    if (s && !styles.includes(s)) setStyles([...styles, s])
    setExtraStyle('')
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPhotoData(await toWebpBase64(file))
      setPhotoLink('')
      setPhotoNote(`Lista: ${file.name}`)
    } catch {
      setPhotoNote('No he podido leer esa imagen, prueba con otra.')
    }
  }

  const submit = () => {
    const patch: PerreoArtistPatch = {
      name: name.trim() || artist.name,
      nickname: nickname.trim() || null,
      kind,
      country: country.trim() || null,
      city: city.trim() || null,
      debutYear: /^\d{4}$/.test(year.trim()) ? Number(year) : null,
      styles,
      labels: parseLabelLines(labels, artist.labels),
      bio: bio.trim() || null,
      hidden,
      // La popularidad importada lleva decimales: solo se manda si la mueves (si no, quedaría como manual sin querer).
      fame: fame !== Math.round(artist.fame) ? fame : undefined,
      streetLevel: street,
      listeners: /^\d+$/.test(listeners.trim()) ? Number(listeners) : null,
      realName: realName.trim() || null,
      birthDate: /^\d{4}(-\d{2}-\d{2})?$/.test(birthDate.trim()) ? birthDate.trim() : null,
      status: status || null,
      activeUntil: /^\d{4}$/.test(until.trim()) ? Number(until) : null,
      aliases: lines(aliases),
      collaborators: lines(collaborators),
      youtubeChannelId: channel.trim() || null,
      // Sin color propio manda el de su foto (calculado): solo se manda si eliges uno o quitas el tuyo.
      color: color ? color : artist.manualFields?.includes('color') ? null : undefined,
    }
    const editedLinks = changedLinks(artist.links, links)
    if (editedLinks) patch.links = editedLinks
    if (photoData) patch.photoData = photoData
    else if (photoLink.trim()) patch.photoUrl = photoLink.trim()
    if (featuredLink.trim()) patch.featured = featuredLink.trim()
    else if (featured !== (artist.featuredVideoId ?? '')) patch.featured = featured || null
    onSave(patch)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Editar a ${artist.name}`}
      footer={
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* El aviso va junto a «Guardar»: al final del formulario quedaba fuera de la vista en el móvil. */}
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive break-words">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button size="md" onClick={submit} disabled={saving} className="flex-1">
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Text tone="muted" size="sm">
          Lo que cambies aquí se queda: ni una recarga de datos lo pisa.
        </Text>
        <Field label="Nombre">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />}</Field>
        <Field label="Apodo">{(id) => <Input id={id} value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={80} />}</Field>
        <Field label="Qué es">
          {(id) => (
            <select id={id} value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {kindName(k)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Field label="País">{(id) => <Input id={id} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} />}</Field>
          <Field label="Ciudad">{(id) => <Input id={id} value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />}</Field>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Field label="Nombre real">{(id) => <Input id={id} value={realName} onChange={(e) => setRealName(e.target.value)} maxLength={120} />}</Field>
          <Field label="Nacimiento" hint="AAAA-MM-DD o solo el año.">
            {(id) => <Input id={id} value={birthDate} onChange={(e) => setBirthDate(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))} inputMode="numeric" placeholder="1994-03-10" />}
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-3">
          <Field label="Año de debut">{(id) => <Input id={id} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2008" />}</Field>
          <Field label="Estado">
            {(id) => (
              <select id={id} value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                <option value="">Sin indicar</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Hasta (año)" hint="Si lo dejó.">{(id) => <Input id={id} value={until} onChange={(e) => setUntil(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2019" />}</Field>
        </div>

        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border-[1.5px] border-border p-3">
          <legend className="px-1 text-sm font-bold">Números</legend>
          <Field label={`Popularidad: ${fame}`} hint="0 underground, 100 mainstream. Sin tocar sale de los oyentes de Last.fm.">
            {(id) => <input id={id} type="range" min={0} max={100} value={fame} onChange={(e) => setFame(Number(e.target.value))} className="min-h-11 w-full accent-[var(--domain)]" />}
          </Field>
          <Field label={street == null ? 'Nivel de calle: sin poner' : `Nivel de calle: ${street}`} hint="Lo de barrio y underground que es, a tu criterio.">
            {(id) => (
              <div className="flex items-center gap-2">
                <input id={id} type="range" min={0} max={100} value={street ?? 50} onChange={(e) => setStreet(Number(e.target.value))} className="min-h-11 w-full accent-[var(--domain)]" />
                {street != null && (
                  <Button type="button" variant="ghost" size="md" onClick={() => setStreet(null)}>
                    Quitar
                  </Button>
                )}
              </div>
            )}
          </Field>
          <Field label="Oyentes (Last.fm)">{(id) => <Input id={id} value={listeners} onChange={(e) => setListeners(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" />}</Field>
        </fieldset>

        <div role="group" aria-label="Estilos" className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Subgéneros</span>
          <div className="flex flex-wrap gap-1.5">
            {allStyles.map((s) => {
              const on = styles.includes(s)
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => toggleStyle(s)} className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-ring">
                  <Chip variant={on ? 'solid' : 'outline'} className={cn('cursor-pointer', on && 'bg-domain text-card')}>
                    {s}
                  </Chip>
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Input aria-label="Otro estilo" placeholder="Otro estilo" value={extraStyle} onChange={(e) => setExtraStyle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStyle())} maxLength={30} />
            <Button type="button" variant="secondary" size="md" onClick={addStyle}>
              Añadir
            </Button>
          </div>
        </div>

        <Field label="Sellos" hint="Uno por línea; con años así: Rimas (2016–2020) o WY Records (2004–hoy).">
          {(id) => <textarea id={id} value={labels} onChange={(e) => setLabels(e.target.value)} rows={3} className={cn(inputClass, 'py-2')} />}
        </Field>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Field label="Alias" hint="Uno por línea. El buscador también los encuentra.">
            {(id) => <textarea id={id} value={aliases} onChange={(e) => setAliases(e.target.value)} rows={3} className={cn(inputClass, 'py-2')} />}
          </Field>
          <Field label="Colaboradores frecuentes" hint="Uno por línea.">
            {(id) => <textarea id={id} value={collaborators} onChange={(e) => setCollaborators(e.target.value)} rows={3} className={cn(inputClass, 'py-2')} />}
          </Field>
        </div>
        <Field label="Biografía corta">
          {(id) => <textarea id={id} value={bio} onChange={(e) => setBio(e.target.value)} rows={5} maxLength={2000} className={cn(inputClass, 'py-2')} />}
        </Field>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="pb-1 text-sm font-bold">Redes y plataformas</legend>
          {LINK_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              {(id) => <Input id={id} type="url" inputMode="url" value={links[f.key]} onChange={(e) => setLinks({ ...links, [f.key]: e.target.value })} placeholder={f.placeholder} />}
            </Field>
          ))}
          <Field label="Canal oficial de YouTube" hint="El id que empieza por UC: de ahí salen sus canciones y sus visitas.">
            {(id) => <Input id={id} value={channel} onChange={(e) => setChannel(e.target.value.trim())} maxLength={24} placeholder="UC…" />}
          </Field>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="pb-1 text-sm font-bold">Su color</legend>
          <span className="text-xs text-muted-foreground">El que brilla al desbloquear con su frase y en su ficha. Sin elegir, sale de su foto.</span>
          <div className="flex items-center gap-3">
            <input type="color" aria-label="Color propio" value={color || artist.color || '#ff4fd0'} onChange={(e) => setColor(e.target.value)} className="size-11 cursor-pointer rounded-md border-[1.5px] border-border bg-transparent" />
            <span className="text-sm">{color ? color : 'El de su foto'}</span>
            {color && (
              <Button type="button" variant="ghost" size="md" onClick={() => setColor('')}>
                Usar el de su foto
              </Button>
            )}
          </div>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="pb-1 text-sm font-bold">Foto</legend>
          <img src={photoUrl} alt="" className="size-20 rounded-lg bg-secondary object-cover object-top" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
          <Field label="Pega el enlace de una imagen">{(id) => <Input id={id} type="url" inputMode="url" value={photoLink} onChange={(e) => (setPhotoLink(e.target.value), setPhotoData(null), setPhotoNote(null))} placeholder="https://…/foto.jpg" />}</Field>
          <Field label="O sube un archivo" hint={photoNote ?? 'Se pasa a WebP en tu móvil.'}>
            {(id) => <input id={id} type="file" accept="image/*" onChange={(e) => void pickFile(e.target.files?.[0])} className="min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:font-bold file:text-foreground" />}
          </Field>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="pb-1 text-sm font-bold">Canción destacada</legend>
          <Field label="Elige una de sus canciones">
            {(id) => (
              <select id={id} value={featured} onChange={(e) => setFeatured(e.target.value)} className={inputClass}>
                <option value="">La más popular</option>
                {ownSongs.map((s) => (
                  <option key={s.videoId} value={s.videoId}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="O pega un enlace de YouTube" hint="Si lo rellenas, manda sobre la lista.">
            {(id) => <Input id={id} type="url" inputMode="url" value={featuredLink} onChange={(e) => setFeaturedLink(e.target.value)} placeholder="https://youtu.be/…" />}
          </Field>
        </fieldset>

        <div className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-border p-3">
          <div className="min-w-0">
            <div className="text-sm font-bold">Ocultar artista</div>
            <div className="text-xs text-muted-foreground">No sale en el explorador. No se borra.</div>
          </div>
          <Switch checked={hidden} onCheckedChange={setHidden} label="Ocultar artista" />
        </div>
      </form>
    </BottomSheet>
  )
}
