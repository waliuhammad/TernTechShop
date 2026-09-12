import { ImagePlus, Link2, Star, X } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  ACCEPTED_IMAGE_TYPES,
  isCloudinaryConfigured,
  uploadProductImage,
  validateImageFile,
} from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

const MAX_IMAGES = 12;

interface ImageManagerProps {
  images: string[];
  onChange: (images: string[]) => void;
  /** Lets the editor block saving while an upload would otherwise be lost. */
  onUploadingChange: (uploading: boolean) => void;
  error?: string | undefined;
}

export function ImageManager({ images, onChange, onUploadingChange, error }: ImageManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState('');

  const room = MAX_IMAGES - images.length;

  const upload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const found: string[] = [];

    // Reject bad files up front rather than after a wasted round trip.
    const valid = files.filter((file) => {
      const problem = validateImageFile(file);
      if (problem) found.push(problem);
      return !problem;
    });

    if (valid.length > room) {
      found.push(`Only ${room} more image${room === 1 ? '' : 's'} allowed (max ${MAX_IMAGES}).`);
      valid.splice(room);
    }

    if (valid.length === 0) {
      setProblems(found);
      return;
    }

    setProblems([]);
    setProgress({ done: 0, total: valid.length });
    onUploadingChange(true);

    const uploaded: string[] = [];
    // Sequential: keeps ordering predictable and stays gentle on a slow connection.
    for (const file of valid) {
      try {
        uploaded.push(await uploadProductImage(file));
      } catch (caught) {
        found.push(caught instanceof Error ? caught.message : `${file.name}: upload failed.`);
      }
      setProgress((current) => (current ? { ...current, done: current.done + 1 } : current));
    }

    if (uploaded.length) onChange([...images, ...uploaded]);
    setProblems(found);
    setProgress(null);
    onUploadingChange(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const addUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      setProblems([`Not a valid image URL: ${url}`]);
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setProblems([`At most ${MAX_IMAGES} images.`]);
      return;
    }
    onChange([...images, url]);
    setUrlDraft('');
    setProblems([]);
  };

  const remove = (index: number) => onChange(images.filter((_, i) => i !== index));

  const makeMain = (index: number) => {
    const next = [...images];
    const [picked] = next.splice(index, 1);
    if (picked) onChange([picked, ...next]);
  };

  return (
    <div className="space-y-4">
      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-xl border-2 bg-white',
                index === 0 ? 'border-primary' : 'border-slate-200',
              )}
            >
              <img src={url} alt="" className="h-full w-full object-contain p-1" />
              {index === 0 && (
                <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-black text-white uppercase">
                  Main
                </span>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                {index !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeMain(index)}
                    aria-label="Make main image"
                    title="Make main image"
                    className="cursor-pointer rounded-md bg-white/90 p-1 text-slate-600 shadow hover:text-primary"
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove image"
                  title="Remove image"
                  className="cursor-pointer rounded-md bg-white/90 p-1 text-slate-600 shadow hover:text-rose-600"
                >
                  <X size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          No images yet. The first image is the one shown on product cards.
        </p>
      )}

      {isCloudinaryConfigured ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={(event) => void upload(event.target.files)}
            className="hidden"
            id="product-image-upload"
            disabled={Boolean(progress) || room <= 0}
          />
          <label
            htmlFor="product-image-upload"
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-sm font-bold transition-colors',
              progress || room <= 0
                ? 'cursor-not-allowed border-slate-200 text-slate-300'
                : 'cursor-pointer border-primary/30 text-primary hover:border-primary hover:bg-primary/5',
            )}
          >
            <ImagePlus size={18} />
            {progress
              ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
              : room <= 0
                ? `Maximum ${MAX_IMAGES} images`
                : 'Upload images (JPG, PNG, WebP · up to 5 MB each)'}
          </label>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          Uploading is off until Cloudinary is connected (see <code className="font-mono">docs/CLOUDINARY-SETUP.md</code>).
          You can still add images by URL below.
        </p>
      )}

      <div className="flex gap-2">
        <div className="relative flex-grow">
          <Link2 size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addUrl();
              }
            }}
            placeholder="…or paste an image URL"
            aria-label="Image URL"
            className="field-input pl-9 font-mono text-xs"
          />
        </div>
        <button type="button" onClick={addUrl} className="secondary-btn shrink-0 px-4 py-2 text-xs">
          Add
        </button>
      </div>

      {[...problems, ...(error ? [error] : [])].map((problem) => (
        <p key={problem} className="text-xs font-bold text-rose-500">
          {problem}
        </p>
      ))}
    </div>
  );
}
