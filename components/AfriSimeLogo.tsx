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
      width={300}
      height={90}
      priority={priority}
      className={className}
    />
  )
}