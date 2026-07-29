import Image from 'next/image'

type AfriSimeLogoProps = {
  className?: string
  priority?: boolean  
}

export default function AfriSimeLogo({ className = '', priority = false }: AfriSimeLogoProps) {
  return (
    <Image
      src="/nouveaulogo.jpeg"
      alt="AfriSime Communauté"
      width={1254}
      height={1254}
      unoptimized
      priority={priority}
      className={className}
    />
  )
}