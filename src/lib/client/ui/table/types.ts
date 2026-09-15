export interface Column<T> {
	key: keyof T & string;
	header: string;
	icon?: { src: string; alt: string };
	width?: string;
	align?: 'left' | 'center' | 'right';
	sortable?: boolean;
}
