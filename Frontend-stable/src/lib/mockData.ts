const ROAD_DAMAGE_URLS = [
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1007599_RS_386_386RS289112_28920/1007599_RS_386_386RS289112_28920_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1007600_RS_386_386RS289112_28925/1007600_RS_386_386RS289112_28925_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1007607_RS_386_386RS289112_28960/1007607_RS_386_386RS289112_28960_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1007608_RS_386_386RS289112_28966/1007608_RS_386_386RS289112_28966_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1008367_RS_386_386RS289112_32760/1008367_RS_386_386RS289112_32760_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1008560_RS_386_386RS289112_33725/1008560_RS_386_386RS289112_33725_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014583_RS_386_386RS124739_29840/1014583_RS_386_386RS124739_29840_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014584_RS_386_386RS124739_29845/1014584_RS_386_386RS124739_29845_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014585_RS_386_386RS124739_29850/1014585_RS_386_386RS124739_29850_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014586_RS_386_386RS124739_29855/1014586_RS_386_386RS124739_29855_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014587_RS_386_386RS124739_29860/1014587_RS_386_386RS124739_29860_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014603_RS_386_386RS124739_29940/1014603_RS_386_386RS124739_29940_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014604_RS_386_386RS124739_29945/1014604_RS_386_386RS124739_29945_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014609_RS_386_386RS124739_29970/1014609_RS_386_386RS124739_29970_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014610_RS_386_386RS124739_29975/1014610_RS_386_386RS124739_29975_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014611_RS_386_386RS124739_29980/1014611_RS_386_386RS124739_29980_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014612_RS_386_386RS124739_29985/1014612_RS_386_386RS124739_29985_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014613_RS_386_386RS124739_29990/1014613_RS_386_386RS124739_29990_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014615_RS_386_386RS124739_30000/1014615_RS_386_386RS124739_30000_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014616_RS_386_386RS124739_30005/1014616_RS_386_386RS124739_30005_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014617_RS_386_386RS124739_30010/1014617_RS_386_386RS124739_30010_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014618_RS_386_386RS124739_30015/1014618_RS_386_386RS124739_30015_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014619_RS_386_386RS124739_30020/1014619_RS_386_386RS124739_30020_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014620_RS_386_386RS124739_30025/1014620_RS_386_386RS124739_30025_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014621_RS_386_386RS124739_30030/1014621_RS_386_386RS124739_30030_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014622_RS_386_386RS124739_30035/1014622_RS_386_386RS124739_30035_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014623_RS_386_386RS124739_30040/1014623_RS_386_386RS124739_30040_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014624_RS_386_386RS124739_30045/1014624_RS_386_386RS124739_30045_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014625_RS_386_386RS124739_30050/1014625_RS_386_386RS124739_30050_RAW.jpg",
  "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/1014626_RS_386_386RS124739_30055/1014626_RS_386_386RS124739_30055_RAW.jpg",
];

const KECAMATAN = [
  "Sidoarjo",
  "Buduran",
  "Gedangan",
  "Sedati",
  "Waru",
  "Taman",
  "Krian",
  "Balongbendo",
  "Wonoayu",
  "Sukodono",
  "Candi",
  "Porong",
  "Krembung",
  "Tulangan",
  "Tanggulangin",
  "Jabon",
  "Tarik",
  "Prambon",
] as const;

/** Titik tengah GPS tiap kecamatan di Kabupaten Sidoarjo. */
const KECAMATAN_GPS: Record<string, [number, number]> = {
  Sidoarjo: [-7.4521, 112.7188],
  Buduran: [-7.4207, 112.724],
  Gedangan: [-7.3967, 112.6926],
  Sedati: [-7.369, 112.7805],
  Waru: [-7.3511, 112.7688],
  Taman: [-7.3727, 112.6695],
  Krian: [-7.4086, 112.5733],
  Balongbendo: [-7.4418, 112.5295],
  Wonoayu: [-7.469, 112.6238],
  Sukodono: [-7.3892, 112.6461],
  Candi: [-7.4946, 112.734],
  Porong: [-7.5398, 112.6869],
  Krembung: [-7.5213, 112.6272],
  Tulangan: [-7.506, 112.6538],
  Tanggulangin: [-7.5128, 112.7094],
  Jabon: [-7.5734, 112.7509],
  Tarik: [-7.4517, 112.5549],
  Prambon: [-7.5425, 112.606],
};

const STATUSES = ["Menunggu Review", "Disetujui", "Sedang Diperbaiki", "Selesai"] as const;
const SEVERITIES = ["Rusak Berat", "Rusak Sedang", "Rusak Ringan"] as const;

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Hasilkan koordinat acak dalam radius maxMeters dari titik pusat. */
function nearbyGps(
  centerLat: number,
  centerLng: number,
  maxMeters: number,
): { lat: number; lng: number } {
  const latPerMeter = 1.0 / 111320.0;
  const lngPerMeter = 1.0 / (111320.0 * Math.cos((centerLat * Math.PI) / 180));
  const angle = Math.random() * 2 * Math.PI;
  const dist = Math.random() * maxMeters;
  return {
    lat: parseFloat((centerLat + Math.cos(angle) * dist * latPerMeter).toFixed(8)),
    lng: parseFloat((centerLng + Math.sin(angle) * dist * lngPerMeter).toFixed(8)),
  };
}

function pick<T>(arr: readonly T[]): T {
  return arr[rand(0, arr.length - 1)];
}

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString();
}

export function randomImageUrl(index: number): string {
  return ROAD_DAMAGE_URLS[index % ROAD_DAMAGE_URLS.length];
}

export interface DistrictStat {
  district: string;
  total: number;
  rusak_berat: number;
  rusak_sedang: number;
  rusak_ringan: number;
  avg_severity_score: number;
}

export interface MonthlyTrend {
  month: string;
  label: string;
  total: number;
  rusak_berat: number;
  selesai: number;
}

export function getMockDistrictStats(): DistrictStat[] {
  return KECAMATAN.map((name) => {
    const total = rand(5, 35);
    const rusak_berat = rand(1, Math.round(total * 0.5));
    const rusak_sedang = rand(1, Math.round(total * 0.4));
    const rusak_ringan = total - rusak_berat - rusak_sedang;
    return {
      district: name,
      total,
      rusak_berat,
      rusak_sedang,
      rusak_ringan,
      avg_severity_score: parseFloat((rand(15, 30) / 10).toFixed(1)),
    };
  });
}

export function getMockMonthlyTrend(): MonthlyTrend[] {
  const months = [
    { month: "2026-01", label: "Jan" },
    { month: "2026-02", label: "Feb" },
    { month: "2026-03", label: "Mar" },
    { month: "2026-04", label: "Apr" },
    { month: "2026-05", label: "Mei" },
    { month: "2026-06", label: "Jun" },
  ];
  let base = rand(50, 70);
  return months.map((m, i) => {
    base += rand(-5, 15);
    const total = Math.max(base, 10);
    const rusak_berat = rand(Math.round(total * 0.2), Math.round(total * 0.5));
    const selesai = rand(Math.round(total * 0.15), Math.round(total * 0.35));
    return { ...m, total, rusak_berat, selesai };
  });
}

export function getMockStats() {
  const districts = getMockDistrictStats();
  const total = districts.reduce((s, d) => s + d.total, 0);
  const rusak_berat = districts.reduce((s, d) => s + d.rusak_berat, 0);
  const rusak_sedang = districts.reduce((s, d) => s + d.rusak_sedang, 0);
  const rusak_ringan = districts.reduce((s, d) => s + d.rusak_ringan, 0);
  const monthly_trend = getMockMonthlyTrend().map((m) => ({
    bulan: m.month,
    total: m.total,
    selesai: m.selesai,
    rusak_berat: m.rusak_berat,
  }));
  return {
    total,
    menunggu_review: rand(5, 25),
    disetujui: rand(3, 20),
    ditolak: rand(1, 8),
    sedang_diperbaiki: rand(3, 15),
    selesai: rand(5, 30),
    trust_hijau: rand(Math.round(total * 0.4), Math.round(total * 0.7)),
    trust_kuning: rand(Math.round(total * 0.15), Math.round(total * 0.35)),
    trust_merah: rand(Math.round(total * 0.05), Math.round(total * 0.15)),
    rusak_berat,
    rusak_sedang,
    rusak_ringan,
    monthly_trend,
    districts,
  };
}

export function getMockTeamStats() {
  return [
    {
      team_id: "1",
      team_name: "Satgas Utara",
      wilayah: "Waru, Sedati, Buduran",
      total: rand(10, 30),
      sedang_diperbaiki: rand(2, 8),
      selesai: rand(3, 12),
      total_panjang_m: rand(100, 500),
      total_luas_m2: rand(200, 800),
    },
    {
      team_id: "2",
      team_name: "Satgas Selatan",
      wilayah: "Porong, Tanggulangin, Jabon",
      total: rand(10, 30),
      sedang_diperbaiki: rand(2, 8),
      selesai: rand(3, 12),
      total_panjang_m: rand(100, 500),
      total_luas_m2: rand(200, 800),
    },
    {
      team_id: "3",
      team_name: "Satgas Barat",
      wilayah: "Krian, Balongbendo, Tarik",
      total: rand(10, 30),
      sedang_diperbaiki: rand(2, 8),
      selesai: rand(3, 12),
      total_panjang_m: rand(100, 500),
      total_luas_m2: rand(200, 800),
    },
    {
      team_id: "4",
      team_name: "Satgas Timur",
      wilayah: "Sidoarjo, Candi, Tulangan",
      total: rand(10, 30),
      sedang_diperbaiki: rand(2, 8),
      selesai: rand(3, 12),
      total_panjang_m: rand(100, 500),
      total_luas_m2: rand(200, 800),
    },
  ];
}

const ROAD_NAMES = [
  "Jl. Raya Porong",
  "Jl. Ahmad Yani",
  "Jl. Gajah Mada",
  "Jl. Majapahit",
  "Jl. Pahlawan",
  "Jl. Diponegoro",
  "Jl. Jenggolo",
  "Jl. Thamrin",
  "Jl. Sudirman",
  "Jl. Raya Buduran",
  "Jl. Raya Waru",
  "Jl. Raya Taman",
  "Jl. Raya Krian",
  "Jl. Raya Candi",
  "Jl. Raya Tanggulangin",
  "Jl. Raya Sedati",
  "Jl. Raya Sukodono",
  "Jl. Raya Wonoayu",
];

export interface MockPhoto {
  id: string;
  image_original_url: string;
  sort_order: number;
  created_at: string;
}

export interface MockReport {
  id: string;
  report_code: string;
  road_name: string;
  district: string;
  status: string;
  overall_severity: string;
  first_photo_url: string;
  photos_count: number;
  photos: MockPhoto[];
  created_at: string;
  latitude: number;
  longitude: number;
}

export function getMockReports(count: number = 10): MockReport[] {
  const reports: MockReport[] = [];
  for (let i = 0; i < count; i++) {
    const seed = rand(1000, 9999);
    const daysAgo = rand(0, 180);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const isBatch = i < Math.min(8, count);
    const photoCount = isBatch ? rand(2, 4) : 1;
    const photos: MockPhoto[] = [];
    for (let j = 0; j < photoCount; j++) {
      const urlIdx = (i + j) % ROAD_DAMAGE_URLS.length;
      photos.push({
        id: `mock-photo-${seed}-${j}`,
        image_original_url: ROAD_DAMAGE_URLS[urlIdx],
        sort_order: j,
        created_at: date.toISOString(),
      });
    }
    const district = pick(KECAMATAN);
    const gps = nearbyGps(...(KECAMATAN_GPS[district] ?? [-7.4521, 112.7188]), 1500);
    reports.push({
      id: `mock-${seed}`,
      report_code: `LP-2026-${String(rand(1, 999)).padStart(5, "0")}`,
      road_name: pick(ROAD_NAMES),
      district,
      status: pick(STATUSES),
      overall_severity: pick(SEVERITIES),
      first_photo_url: photos[0].image_original_url,
      photos_count: photos.length,
      photos,
      created_at: date.toISOString(),
      latitude: gps.lat,
      longitude: gps.lng,
    });
  }
  return reports.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
