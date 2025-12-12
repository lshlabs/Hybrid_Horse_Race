export type RunStyleId = 'paceSetter' | 'frontRunner' | 'stalker' | 'closer'

export const RUN_STYLE_IDS: RunStyleId[] = ['paceSetter', 'frontRunner', 'stalker', 'closer']

export const RUN_STYLE_ACCENT: Record<RunStyleId, 'primary' | 'accent' | 'success' | 'warning'> = {
  paceSetter: 'primary',
  frontRunner: 'accent',
  stalker: 'success',
  closer: 'warning',
}
