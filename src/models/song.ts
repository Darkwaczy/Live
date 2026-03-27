export interface SongLine {
  line: string;
  order: number;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  lyrics: SongLine[];
  tags?: string[];
}
