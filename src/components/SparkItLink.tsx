import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { SPARK_COMPOSE } from '@/lib/community-navigation';
import SparkIcon from '@/components/SparkIcon';

export const sparkActionClass = 'spark-action coven-press min-h-11 shrink-0';

export default function SparkItLink() {
  return (
    <Button asChild variant="outline" className={sparkActionClass}>
      <Link to={SPARK_COMPOSE}>
        <SparkIcon className="size-5 shrink-0" monochrome />
        Spark it
      </Link>
    </Button>
  );
}
