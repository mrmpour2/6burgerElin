import { cn } from "@/utils/cn";

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  eager?: boolean;
  /** Declares the clip-path reveal contract (`data-image-reveal`). */
  reveal?: boolean;
  /** Declares scrubbed parallax (`data-parallax-image`); the value is the speed. */
  parallax?: number;
  /** اگر تصویر لود نشد (۴۰۴ یا مسدودشده)، والد می‌تواند جایگزین نشان دهد. */
  onError?: () => void;
}

const widths = [480, 768, 1080, 1440, 1920];

function sourceSet(src: string, format: "avif" | "webp") {
  return widths.map((width) => `${src}&w=${width}&fm=${format} ${width}w`).join(", ");
}

export function ResponsiveImage({
  src,
  alt,
  className,
  imageClassName,
  sizes = "(max-width: 768px) 100vw, 50vw",
  eager = false,
  reveal = false,
  parallax,
  onError,
}: ResponsiveImageProps) {
  return (
    <picture
      className={cn("block overflow-hidden", className)}
      {...(reveal ? { "data-image-reveal": "" } : null)}
      {...(parallax !== undefined ? { "data-parallax-section": "" } : null)}
    >
      <source type="image/avif" srcSet={sourceSet(src, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={sourceSet(src, "webp")} sizes={sizes} />
      <img
        src={`${src}&w=1080`}
        srcSet={widths.map((width) => `${src}&w=${width} ${width}w`).join(", ")}
        sizes={sizes}
        alt={alt}
        width="1080"
        height="1080"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        className={cn("h-full w-full object-cover", imageClassName)}
        onError={onError}
        {...(parallax !== undefined
          ? { "data-parallax-image": "", "data-parallax-speed": parallax }
          : null)}
      />
    </picture>
  );
}