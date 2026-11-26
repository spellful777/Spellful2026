import sparkIt from '@/assets/spark-it.png';

export default function SparkIcon({ className = 'size-4', monochrome = false }: { className?: string; monochrome?: boolean }) {
  if (monochrome) {
    return <span aria-hidden="true" className={`block bg-current ${className}`} style={{ mask: `url("${sparkIt}") center / contain no-repeat` }} />;
  }
  return <img src={sparkIt} alt="" aria-hidden="true" width={96} height={96} className={className} />;
}
