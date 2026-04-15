interface BrandMarkProps {
  className?: string;
  alt?: string;
}

export default function BrandMark({ className, alt = 'IBVN - Instituto Bíblico Vinha Nova' }: BrandMarkProps) {
  return <img className={className} src="/brand/logo.jpg" alt={alt} />;
}
