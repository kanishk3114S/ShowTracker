import React from 'react';
import { SearchX } from 'lucide-react';

export default function EmptyState({ title = 'Nothing found', message, icon: Icon = SearchX, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2A3245] bg-[#151922]/50 px-6 py-14 text-center">
      <Icon className="mb-3 h-8 w-8 text-[#9CA3AF]" />
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-[#9CA3AF]">{message}</p>}
      {action}
    </div>
  );
}
