export default function LoadingScreen({ text = 'กำลังโหลดข้อมูล...' }) {
  return (
    <div role="status" aria-live="polite" className="py-8 space-y-3">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{text}</p>
      <div className="space-y-3 animate-pulse" aria-hidden="true">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-zinc-200 dark:border-[#272727] bg-white dark:bg-[#181818] p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 flex-1">
                <div className="h-5 w-10 rounded-md bg-zinc-200 dark:bg-[#272727]" />
                <div className="h-5 w-20 rounded-md bg-zinc-200/80 dark:bg-[#272727]" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-14 rounded-lg bg-zinc-100 dark:bg-[#1F1F1F]" />
                <div className="h-7 w-14 rounded-lg bg-zinc-100 dark:bg-[#1F1F1F]" />
              </div>
            </div>
            <div className="h-4 w-3/4 rounded-md bg-zinc-200/90 dark:bg-[#272727]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="h-9 rounded-xl bg-zinc-100 dark:bg-[#1F1F1F]" />
              <div className="h-9 rounded-xl bg-zinc-100 dark:bg-[#1F1F1F]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
