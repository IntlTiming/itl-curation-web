import { Link } from 'react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useBreadcrumbLabel } from '@/hooks/use-breadcrumb';

export function AppBreadcrumb() {
  const label = useBreadcrumbLabel();

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
        {label && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{label}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
