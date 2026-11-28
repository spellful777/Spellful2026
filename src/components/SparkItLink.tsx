import type { Ref } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { SPARK_COMPOSE } from '@/lib/community-navigation';
import SparkIcon from '@/components/SparkIcon';

export const sparkActionClass = 'spark-action coven-press min-h-11 shrink-0';

interface SparkItLinkProps {
  iconOnly?: boolean;
  linkRef?: Ref<HTMLAnchorElement>;
  inactive?: boolean;
}

export default function SparkItLink({ iconOnly = false, linkRef, inactive = false }: SparkItLinkProps) {
  return (
    <Button asChild variant="outline" size={iconOnly ? 'icon' : 'default'} className={`${sparkActionClass} ${iconOnly ? 'spark-action-icon size-11' : ''}`}>
      <Link
        ref={linkRef}
        to={SPARK_COMPOSE}
        aria-label={iconOnly ? 'Spark it' : undefined}
        aria-hidden={inactive || undefined}
        tabIndex={inactive ? -1 : undefined}
      >
        <SparkIcon className="size-5 shrink-0" monochrome />
        {!iconOnly && 'Spark it'}
      </Link>
    </Button>
  );
}
