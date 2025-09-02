export default {
    props: {
        formPort: String, formJenis: String,
        formStartYear: Number, formStartMonth: Number,
        formEndYear: Number, formEndMonth: Number,
        loading: Boolean,
    },
    emits: [
        'update:formPort', 'update:formJenis',
        'update:formStartYear', 'update:formStartMonth',
        'update:formEndYear', 'update:formEndMonth',
        'fetchInaportnet'
    ],
    template: `
    <section class="bg-white shadow-soft rounded-xl2 border border-ink-100 p-4">
      <div class="grid md:grid-cols-2 gap-x-6 gap-y-4">
        <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">Port & Jenis</label>
            <div class="grid grid-cols-3 gap-2">
                <input :value="formPort" @input="$emit('update:formPort', $event.target.value)" placeholder="PORT" class="col-span-2 px-3 py-2 text-sm rounded-lg border border-ink-200">
                <select :value="formJenis" @input="$emit('update:formJenis', $event.target.value)" class="px-3 py-2 text-sm rounded-lg border border-ink-200">
                    <option value="dn">dn</option><option value="ln">ln</option>
                </select>
            </div>
        </div>

        <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">&nbsp;</label>
            <button @click="$emit('fetchInaportnet')" :disabled="loading" class="w-full px-3 py-2 text-sm rounded-lg bg-ink-900 text-white hover:bg-ink-800 flex items-center justify-center gap-2 disabled:opacity-60">
                <svg v-if="loading" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V4a4 4 0 00-4 4H4z"></path></svg>
                <span>{{ loading ? 'Memuat...' : 'Ambil & Simpan Data' }}</span>
            </button>
        </div>

        <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">Dari Bulan / Tahun</label>
            <div class="grid grid-cols-2 gap-2">
                <input :value="formStartMonth" @input="$emit('update:formStartMonth', $event.target.valueAsNumber)" type="number" min="1" max="12" class="px-3 py-2 text-sm rounded-lg border border-ink-200" placeholder="Bulan">
                <input :value="formStartYear" @input="$emit('update:formStartYear', $event.target.valueAsNumber)" type="number" class="px-3 py-2 text-sm rounded-lg border border-ink-200" placeholder="Tahun">
            </div>
        </div>
        <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">Sampai Bulan / Tahun</label>
            <div class="grid grid-cols-2 gap-2">
                <input :value="formEndMonth" @input="$emit('update:formEndMonth', $event.target.valueAsNumber)" type="number" min="1" max="12" class="px-3 py-2 text-sm rounded-lg border border-ink-200" placeholder="Bulan">
                <input :value="formEndYear" @input="$emit('update:formEndYear', $event.target.valueAsNumber)" type="number" class="px-3 py-2 text-sm rounded-lg border border-ink-200" placeholder="Tahun">
            </div>
        </div>
      </div>
    </section>
    `
};