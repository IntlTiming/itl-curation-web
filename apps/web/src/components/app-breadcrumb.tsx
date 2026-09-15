import { Fragment } from 'react';
import { Link } from 'react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useBreadcrumbSegments } from '@/hooks/use-breadcrumb';

export function AppBreadcrumb() {
  const segments = useBreadcrumbSegments();

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="text-foreground flex items-center gap-2 font-semibold">
              <img src="/favicon.png" alt="" className="size-6 rounded" />
              ITL Curation
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => (
          <Fragment key={index}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {segment.to ? (
                <BreadcrumbLink asChild>
                  <Link to={segment.to}>{segment.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{segment.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
