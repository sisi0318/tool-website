import Image from "next/image"

interface HomeMascotProps {
  alt: string
  name: string
  description: string
}

export function HomeMascot({ alt, name, description }: HomeMascotProps) {
  return (
    <figure className="relative mx-auto w-full max-w-[35rem] lg:mx-0 lg:justify-self-end">
      <Image
        src="/mascot.svg?v=3"
        alt={alt}
        width={560}
        height={560}
        priority
        className="home-mascot-art h-auto w-full select-none"
        draggable={false}
      />
      <figcaption className="relative mx-auto -mt-3 flex w-fit max-w-full items-center gap-3 rounded-full border border-[var(--md-sys-color-outline-variant)]/60 bg-[var(--md-sys-color-surface-container-lowest)]/80 px-5 py-2.5 text-sm backdrop-blur-sm sm:-mt-1">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-[var(--md-sys-color-primary)]/20 ring-4 ring-[var(--md-sys-color-primary)]/10" />
          <span className="relative h-2 w-2 rounded-full bg-[var(--md-sys-color-primary)]" />
        </span>
        <span className="font-bold text-[var(--md-sys-color-on-surface)]">{name}</span>
        <span className="h-3 w-px bg-[var(--md-sys-color-outline-variant)]" aria-hidden="true" />
        <span className="text-[var(--md-sys-color-on-surface-variant)]">{description}</span>
      </figcaption>
    </figure>
  )
}
