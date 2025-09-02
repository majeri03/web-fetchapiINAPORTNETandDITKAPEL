export default {
    props: {
        canExport: Boolean
    },
    emits: ['logout', 'reset', 'export'],
    template: `
      <header class="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-ink-100">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-xl2 bg-ink-900 text-white grid place-content-center shadow-soft">DV</div>
            <div>
              <h1 class="text-xl font-semibold tracking-tight">Inaportnet & Ditkapel Viewer</h1>
              <p class="text-xs text-ink-600">Fetch via URL • Filter • Search • Export Excel</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="$emit('logout')" class="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50">Logout</button>
            <button @click="$emit('reset')" class="px-3 py-2 text-sm rounded-lg border border-ink-200 hover:bg-ink-100">Reset</button>
            <button @click="$emit('export')" :disabled="!canExport"
                    class="px-3 py-2 text-sm rounded-lg bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-40">Download Excel</button>
          </div>
        </div>
      </header>
    `
};