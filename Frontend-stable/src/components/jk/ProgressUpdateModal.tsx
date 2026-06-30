import { useState } from "react";
import { ModalBase } from "@/components/jk/ModalBase";
import { Icon } from "@/components/jk/Icon";
import { API_BASE_URL } from "@/lib/aiStore";

interface ProgressUpdateModalProps {
  reportId: string;
  reportCode: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProgressUpdateModal({
  reportId,
  reportCode,
  token,
  onClose,
  onSuccess,
}: ProgressUpdateModalProps) {
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit() {
    if (!foto) {
      setError("Foto progress wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("foto", foto);
      if (catatan.trim()) fd.append("catatan", catatan.trim());

      const res = await fetch(`${API_BASE_URL}/reports/${reportId}/progress`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(json.message ?? "Gagal upload progress.");
      }
    } catch {
      setError("Kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalBase
      onClose={onClose}
      icon="add_a_photo"
      badge="PROGRESS"
      title="Upload Progress Perbaikan"
      footer={
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] disabled:opacity-40 transition-all"
          >
            {loading ? "Mengupload..." : "Upload Progress"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 bg-white border border-[#D0DAE8] text-[#64748B] rounded-lg text-[14px] font-semibold hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-all"
          >
            Batal
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-[#475569] leading-relaxed">
        Progress laporan <strong>{reportCode}</strong>
      </p>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-[#E11D48]">
          {error}
        </div>
      )}

      <div>
        <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">
          Foto Progress <span className="text-[#E11D48]">*</span>
        </label>
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#D0DAE8] rounded-lg cursor-pointer hover:border-[#1A4F8A] transition-colors bg-[#F8FAFC]">
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Icon name="add_a_photo" className="!text-2xl text-[#64748B]" />
              <span className="text-[11px] text-[#64748B]">Ketuk untuk pilih foto</span>
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleFile}
            className="hidden"
          />
        </label>
      </div>

      <div>
        <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">
          Catatan (opsional)
        </label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Deskripsi progress..."
          className="w-full h-20 px-3 py-2 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A] resize-none"
        />
      </div>
    </ModalBase>
  );
}
