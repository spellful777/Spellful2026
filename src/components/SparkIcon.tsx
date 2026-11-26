import sparkIt from '@/assets/spark-it.png';

export default function SparkIcon({ className = 'size-4' }: { className?: string }) {
  return <img src={sparkIt} alt="" aria-hidden="true" width={96} height={96} className={className} />;
}
