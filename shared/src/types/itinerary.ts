export type ActivityCategory =
  | 'Sightseeing'
  | 'Food'
  | 'Transport'
  | 'Accommodation'
  | 'Adventure'
  | 'Other';

export interface Activity {
  id: string;
  tripId: string;
  name: string;
  description?: string;
  location?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  category: ActivityCategory;
  createdAt: string;
}

export interface CreateActivityRequest {
  name: string;
  description?: string;
  location?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  category: ActivityCategory;
}
