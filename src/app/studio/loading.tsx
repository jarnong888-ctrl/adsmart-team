export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-3 w-24 rounded bg-[#D5E3DD]" />
      <div className="h-7 w-1/2 rounded bg-[#D5E3DD]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-[8px] bg-[#D5E3DD]" />
        <div className="h-24 rounded-[8px] bg-[#D5E3DD]" />
        <div className="h-24 rounded-[8px] bg-[#D5E3DD]" />
      </div>
      <div className="h-44 rounded-[8px] bg-[#D5E3DD]" />
    </div>
  );
}
