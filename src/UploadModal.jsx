import { useState } from 'react';
import { supabase } from './supabaseClient.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function UploadModal({ session, onClose, onUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const userId = session?.user?.id;
    setErrorMessage('');
    setSuccessMessage('');

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Check your Vite environment variables.');
      return;
    }

    if (!userId) {
      setErrorMessage('You must be signed in to upload a paper.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const title = formData.get('title')?.toString().trim();
    const methodology = formData.get('methodology')?.toString().trim();

    if (!title || !methodology || !selectedFile) {
      setErrorMessage('Complete all fields and choose a PDF to continue.');
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Choose a PDF file.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage('The PDF must be 5 MB or smaller.');
      return;
    }

    setIsUploading(true);

    try {
      const filePath = `${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('paper_pdfs')
        .upload(filePath, selectedFile, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('paper_pdfs')
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Could not get a public URL for the uploaded PDF.');
      }

      const { error: insertError } = await supabase.from('papers').insert({
        title,
        methodology,
        pdf_url: publicUrlData.publicUrl,
        uploaded_by: session.user.id,
      });

      if (insertError) throw insertError;

      setSuccessMessage('Paper summary uploaded successfully.');
      form.reset();
      setSelectedFile(null);
      onUploaded?.();
    } catch (error) {
      setErrorMessage(error.message || 'The paper could not be uploaded. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#17201dcc] p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isUploading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        className="my-auto w-full max-w-xl rounded-lg bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b34e35]">
              Add to the library
            </p>
            <h2 id="upload-title" className="mt-2 font-serif text-2xl text-[#202724]">
              Upload a research paper
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-md px-3 py-2 text-sm font-medium text-[#59655f] hover:bg-[#f1f4f1] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="paper-title" className="mb-1.5 block text-sm font-semibold text-[#303b35]">
              Paper title
            </label>
            <input
              id="paper-title"
              name="title"
              type="text"
              required
              maxLength={300}
              className="w-full rounded-md border border-[#cfd8d1] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#176b58] focus:ring-2 focus:ring-[#176b5826]"
              placeholder="Enter the paper title"
            />
          </div>

          <div>
            <label htmlFor="paper-methodology" className="mb-1.5 block text-sm font-semibold text-[#303b35]">
              Methodology summary
            </label>
            <textarea
              id="paper-methodology"
              name="methodology"
              required
              rows={5}
              maxLength={5000}
              className="w-full resize-y rounded-md border border-[#cfd8d1] bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[#176b58] focus:ring-2 focus:ring-[#176b5826]"
              placeholder="Summarize the methods used in this research"
            />
          </div>

          <div>
            <label htmlFor="paper-pdf" className="mb-1.5 block text-sm font-semibold text-[#303b35]">
              Paper PDF
            </label>
            <input
              id="paper-pdf"
              name="pdf"
              type="file"
              accept=".pdf,application/pdf"
              required
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setErrorMessage('');
              }}
              className="block w-full cursor-pointer rounded-md border border-[#cfd8d1] bg-white text-sm text-[#59655f] file:mr-4 file:border-0 file:bg-[#edf3ef] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-[#176b58] hover:file:bg-[#e2ece5]"
            />
            <p className="mt-1.5 text-xs text-[#68746e]">PDF only, up to 5 MB.</p>
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p role="status" className="rounded-md bg-[#eaf4ee] px-3 py-2 text-sm text-[#176b58]">
              {successMessage}
            </p>
          )}

          <div className="flex justify-end border-t border-[#e5e9e5] pt-5">
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex min-w-36 items-center justify-center rounded-md bg-[#176b58] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#105744] disabled:cursor-wait disabled:opacity-70"
            >
              {isUploading ? 'Uploading...' : 'Upload paper'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}