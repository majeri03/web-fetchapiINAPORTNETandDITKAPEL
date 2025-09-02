export default {
    props: {
        companySummary: Array
    },
    emits: ['exportSummary'],
    template: `
    <section class="bg-white border border-ink-100 rounded-xl2 shadow-soft overflow-hidden">
        <div class="px-4 py-3 flex items-center justify-between">
            <div class="text-sm font-medium">Ringkasan per Perusahaan Unik (berdasarkan filter aktif)</div>
            <button @click="$emit('exportSummary')" :disabled="companySummary.length === 0" class="px-3 py-2 text-sm rounded-lg bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-40">
                Export Ringkasan (Excel)
            </button>
        </div>
        <div class="overflow-auto scrollbar-thin">
            <table class="min-w-full text-sm">
                <thead class="bg-ink-50 border-y border-ink-100">
                <tr>
                    <th class="text-left px-4 py-2 font-semibold">Nama Perusahaan</th>
                    <th class="text-left px-4 py-2 font-semibold">Jumlah Kapal Unik</th>
                    <th class="text-left px-4 py-2 font-semibold">Total Catatan</th>
                    <th class="text-left px-4 py-2 font-semibold">Daftar Nama Kapal</th>
                </tr>
                </thead>
                <tbody v-if="companySummary.length">
                <tr v-for="summary in companySummary" :key="summary.companyName" class="border-b border-ink-100 hover:bg-ink-50/40">
                    <td class="px-4 py-2 font-semibold">{{ summary.companyName }}</td>
                    <td class="px-4 py-2 tabular-nums">{{ summary.uniqueShipCount }}</td>
                    <td class="px-4 py-2 tabular-nums">{{ summary.totalRecords }}</td>
                    <td class="px-4 py-2 text-xs text-ink-600 max-w-md truncate" :title="summary.shipList">{{ summary.shipList }}</td>
                </tr>
                </tbody>
                <tbody v-else>
                <tr>
                    <td colspan="4" class="px-4 py-10 text-center text-ink-600">Tidak ada data untuk ditampilkan. Coba bersihkan filter Anda.</td>
                </tr>
                </tbody>
            </table>
        </div>
    </section>
    `
};