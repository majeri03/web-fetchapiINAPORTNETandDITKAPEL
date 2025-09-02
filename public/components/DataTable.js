export default {
    props: {
        rows: Array,
        filteredRows: Array,
        pagedRows: Array,
        visibleColumns: Array,
        page: Object,
        maxPage: Number,
        loading: Boolean,
        statUnique: Function
    },
    emits: ['exportExcel', 'exportCsv', 'lookupDitkapel', 'goPage'],
    template: `
        <div>
            <section class="grid sm:grid-cols-3 gap-3">
                <div class="bg-white border border-ink-100 rounded-xl2 p-4 shadow-soft">
                    <div class="text-xs text-ink-600">Total Baris</div>
                    <div class="text-2xl font-semibold mt-1">{{ rows.length }}</div>
                </div>
                <div class="bg-white border border-ink-100 rounded-xl2 p-4 shadow-soft">
                    <div class="text-xs text-ink-600">Setelah Filter</div>
                    <div class="text-2xl font-semibold mt-1">{{ filteredRows.length }}</div>
                </div>
                <div class="bg-white border border-ink-100 rounded-xl2 p-4 shadow-soft">
                    <div class="text-xs text-ink-600">Unik (Perusahaan / PKK)</div>
                    <div class="text-sm mt-1">
                        <span class="mr-3">Perusahaan: <b>{{ statUnique('Nama Perusahaan') }}</b></span>
                        <span>PKK: <b>{{ statUnique('Nomor PKK') }}</b></span>
                    </div>
                </div>
            </section>

            <section class="bg-white border border-ink-100 rounded-xl2 shadow-soft overflow-hidden mt-6">
                <div class="px-4 py-3 flex items-center justify-between">
                    <div class="text-sm font-medium">Preview Data</div>
                </div>

                <div class="overflow-auto scrollbar-thin">
                    <table class="min-w-full text-sm">
                        <thead class="bg-ink-50 border-y border-ink-100">
                        <tr>
                            <th v-for="c in visibleColumns" :key="'h-'+c.key" class="text-left px-4 py-2 font-semibold whitespace-nowrap">{{c.label}}</th>
                        </tr>
                        </thead>
                        
                        <transition-group tag="tbody" name="fade-row" v-if="!loading && pagedRows.length">
                        <tr v-for="(r,idx) in pagedRows" :key="r['Nomor PKK'] || idx" class="border-b border-ink-100 hover:bg-ink-50/40">
                            <td v-for="c in visibleColumns" :key="'d-'+idx+'-'+c.key" class="px-4 py-2 whitespace-nowrap">
                            <template v-if="c.key==='Nama Kapal'">
                                <div class="flex items-center gap-2">
                                <span class="tabular-nums">{{ r[c.key] ?? '' }}</span>
                                <button @click="$emit('lookupDitkapel', r[c.key])" title="Cari di Ditkapel" class="text-ink-700 hover:text-ink-900">🔎</button>
                                </div>
                            </template>
                            <template v-else>
                                <span class="tabular-nums">{{ r[c.key] ?? '' }}</span>
                            </template>
                            </td>
                        </tr>
                        </transition-group>

                        <tbody v-if="!loading && !pagedRows.length">
                        <tr><td :colspan="visibleColumns.length" class="px-4 py-10 text-center text-ink-600">Tidak ada data untuk ditampilkan.</td></tr>
                        </tbody>

                        <tbody v-if="loading">
                        <tr v-for="i in 10" :key="'sk-'+i" class="border-b border-ink-100">
                            <td v-for="c in visibleColumns" :key="'skc-'+i+c.key" class="px-4 py-3">
                            <div class="h-3 bg-ink-100 rounded w-3/4 animate-pulse"></div>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>

                <div class="px-4 py-3 flex items-center gap-2 justify-between border-t border-ink-100">
                    <div class="text-xs text-ink-600">
                        Menampilkan <b>{{ Math.min((page.index-1)*page.size+1, filteredRows.length) }}</b> – <b>{{ Math.min(page.index*page.size, filteredRows.length) }}</b>
                        dari <b>{{ filteredRows.length }}</b>
                    </div>
                    <div class="flex items-center gap-1">
                        <button @click="$emit('goPage', 1)" :disabled="page.index===1" class="px-2 py-1 text-sm rounded border border-ink-200 disabled:opacity-40">«</button>
                        <button @click="$emit('goPage', page.index-1)" :disabled="page.index===1" class="px-2 py-1 text-sm rounded border border-ink-200 disabled:opacity-40">Prev</button>
                        <span class="px-2 text-sm">Hal. {{ page.index }} / {{ maxPage }}</span>
                        <button @click="$emit('goPage', page.index+1)" :disabled="page.index===maxPage" class="px-2 py-1 text-sm rounded border border-ink-200 disabled:opacity-40">Next</button>
                        <button @click="$emit('goPage', maxPage)" :disabled="page.index===maxPage" class="px-2 py-1 text-sm rounded border border-ink-200 disabled:opacity-40">»</button>
                    </div>
                </div>
            </section>
        </div>
    `
};