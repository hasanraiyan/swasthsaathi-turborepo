import type { AdherenceSummary } from '@repo/contracts';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { keys, useApi } from './queries';

/**
 * How consistently the user has taken their medicines, over the API's default
 * window of the last 30 days.
 */
export function useAdherence(): UseQueryResult<AdherenceSummary> {
  const api = useApi();
  return useQuery({
    queryKey: keys.adherence,
    queryFn: () => api.get<AdherenceSummary>('/medication-doses/adherence'),
  });
}
