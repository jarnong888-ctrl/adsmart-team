export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-card px-5 py-10 text-center">
      <h2 className="type-h2">{title}</h2>
      <p className="type-body mx-auto mt-2 max-w-md text-[#5E6B65]">{body}</p>
      {children ? <div className="mt-4 flex justify-center">{children}</div> : null}
    </div>
  );
}
