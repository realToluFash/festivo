export interface FocusedHeaderBoard {
  title: string;
  what: string;
  href: string;
}

export const FOCUSED_HEADER_BOARDS: readonly FocusedHeaderBoard[] = [
  {
    title: 'Name · default size',
    what: 'One row at 52, as on main',
    href: '/demo/focused-header?size=default&lang=en&screen=name',
  },
  {
    title: 'Change password · ninth step',
    what: 'The title under Cancel and Save',
    href: '/demo/focused-header?size=ninth&lang=en&screen=password',
  },
  {
    title: 'Time zone · ninth step',
    what: 'Two lines between the sides',
    href: '/demo/focused-header?size=ninth&lang=en&screen=timezone',
  },
  {
    title: 'Nom · ninth step, French',
    what: 'Nom under Annuler and Enregistrer',
    href: '/demo/focused-header?size=ninth&lang=fr&screen=name',
  },
  {
    title: 'Modifier le mot de passe · twelfth step, French',
    what: 'Three rows: Annuler, the title, Enregistrer',
    href: '/demo/focused-header?size=twelfth&lang=fr&screen=password',
  },
  {
    title: 'Due now · twelfth step',
    what: 'Budget’s sheet, Close and Due now whole',
    href: '/demo/focused-header?size=twelfth&lang=en&screen=due-now',
  },
  {
    title: 'Back pill · twelfth step, French',
    what: '‹ Paramètres and ‹ Événements, capsules that grow',
    href: '/demo/focused-header?size=twelfth&lang=fr&screen=back',
  },
  {
    title: 'Nom · Android 200%, French',
    what: 'Three rows on a 360 phone',
    href: '/demo/focused-header?size=android&lang=fr&screen=name',
  },
];
