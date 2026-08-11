import type { PropsWithChildren, ReactNode } from "react";

const SectionCard = ({
  children,
  title,
  description,
  extra,
  footer,
  fill = false,
  stickyFooter = false,
  className = "",
  bodyClassName = "p-4 md:p-6"
}: PropsWithChildren<{
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  fill?: boolean;
  stickyFooter?: boolean;
  className?: string;
  bodyClassName?: string;
}>) => (
  <div
    className={`flex flex-col rounded-xl border border-line bg-surface shadow-sm ${
      fill ? "lg:h-full lg:overflow-hidden" : ""
    } ${className}`}
  >
    {(title || extra) && (
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-4 md:px-6 md:py-5">
        <div className="min-w-0">
          {title && <h2 className="text-xl font-bold text-body">{title}</h2>}
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
        {extra && <div className="shrink-0">{extra}</div>}
      </div>
    )}
    <div
      className={`${bodyClassName} ${
        fill ? "lg:min-h-0 lg:flex-1 lg:overflow-y-auto" : ""
      }`}
    >
      {children}
    </div>
    {footer && (
      <div
        className={`flex shrink-0 items-center justify-between gap-4 border-t border-line bg-surface-subtle px-4 py-4 md:px-6 ${
          stickyFooter
            ? "sticky bottom-0 z-10 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:pb-4"
            : ""
        }`}
      >
        {footer}
      </div>
    )}
  </div>
);

export default SectionCard;
