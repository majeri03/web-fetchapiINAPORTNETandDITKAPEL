export default {
    props: {
        rankedData: Array,
        loading: Boolean
    },
    template: `
    <section class="bg-white shadow-soft rounded-xl2 border border-ink-100">
        <div class="px-4 py-3 border-b">
            <h1 class="text-xl font-bold">Peringkat Pelabuhan Global (Real-time)</h1>
            <p class="text-sm text-ink-600 mt-1">
                Data diambil langsung dari Inaportnet untuk semua pelabuhan di Indonesia pada bulan ini.
            </p>
        </div>
        <div v-if="loading" class="py-20 text-center text-ink-600">
            <svg class="animate-spin h-6 w-6 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V4a4 4 0 00-4 4H4z"></path></svg>
            <span>Mengambil & memproses data dari Inaportnet... Ini mungkin perlu waktu.</span>
        </div>
        <div v-else-if="!rankedData.length" class="py-20 text-center text-ink-600">
            <span>Tidak ada data aktivitas pelabuhan yang ditemukan untuk bulan ini.</span>
        </div>
        <div v-else class="overflow-auto scrollbar-thin max-h-[70vh]">
            <table class="min-w-full text-sm">
                <thead class="bg-ink-50 border-y border-ink-100 sticky top-0">
                    <tr>
                        <th class="text-center px-4 py-2 font-semibold">Peringkat</th>
                        <th class="text-left px-4 py-2 font-semibold">Nama Pelabuhan</th>
                        <th class="text-center px-4 py-2 font-semibold">Jumlah Kapal (Bulan Ini)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(port, index) in rankedData" :key="port.code" class="border-b border-ink-100 hover:bg-ink-50/40">
                        <td class="px-4 py-2 font-bold text-center tabular-nums">{{ index + 1 }}</td>
                        <td class="px-4 py-2">
                            <div class="font-semibold">{{ port.name }}</div>
                            <div class="text-xs text-ink-500 font-mono">{{ port.code }}</div>
                        </td>
                        <td class="px-4 py-2 tabular-nums font-bold text-lg text-center">{{ port.shipCount }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
    `
};