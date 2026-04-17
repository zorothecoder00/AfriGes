import Image from 'next/image'

type AfriSimeLogoProps = {
  className?: string
  priority?: boolean
}

export default function AfriSimeLogo({ className = '', priority = false }: AfriSimeLogoProps) {
  return (
    <Image
      src="/afrisime-logo.svg"
      alt="AfriSime Communauté"
      width={980}
      height={260}
      unoptimized
      priority={priority}
      className={className}
    />
  )
}