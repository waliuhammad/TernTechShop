import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  /** Small blue eyebrow above the title. */
  label: string;
  /** Leading words, rendered in heavy italic uppercase. */
  title: string;
  /** The accent word, rendered upright in brand blue. */
  accent: string;
  description?: string;
  /** Reference styles some descriptions italic and others not. */
  descriptionItalic?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * The storefront's signature section heading: eyebrow, heavy italic uppercase
 * title with one upright accent word, and a rule-bordered description.
 */
export function SectionHeading({
  label,
  title,
  accent,
  description,
  descriptionItalic = false,
  className,
  children,
}: SectionHeadingProps) {
  return (
    <div className={cn('mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end lg:mb-16', className)}>
      <div className="space-y-4">
        <div className="section-label">{label}</div>
        <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic sm:text-4xl md:text-5xl">
          {title} <span className="text-primary not-italic">{accent}</span>
        </h2>
        {description && (
          <p
            className={cn(
              'max-w-lg border-l-2 border-slate-100 pl-6 leading-relaxed font-medium text-slate-500',
              descriptionItalic && 'italic',
            )}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
