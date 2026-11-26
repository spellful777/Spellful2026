import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import SparkIcon from '@/components/SparkIcon';

export const sparkActionClass = 'coven-press min-h-11 shrink-0 border-primary/50 bg-card text-foreground hover:border-primary hover:bg-muted hover:text-foreground';

export default function SparkItLink() {
  return (
    <Button asChild variant="outline" className={sparkActionClass}>
      <Link to="/community/new">
        <SparkIcon className="size-5 shrink-0" />
        Spark it
      </Link>
    </Button>
  );
}
