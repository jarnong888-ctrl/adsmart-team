export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="mb-6">
      {eyebrow ? <p className="type-caption">{eyebrow}</p> : null}
      <h1 className="type-h1 text-[#10251F]">{title}</h1>
      {lede ? <p className="type-body mt-1 max-w-3xl text-[#3D5C54]">{lede}</p> : null}
    </header>
  );
}
