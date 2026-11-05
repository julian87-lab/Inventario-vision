export function VacioSeccion({
  titulo,
  texto,
}: {
  titulo: string
  texto: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
      <p className="font-medium">{titulo}</p>
      <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
    </div>
  )
}