import { type RefObject } from 'react';

/** Your account's band and its title, as `Account`, `Security` and `Notifications` draw it. */
export function AccountHeader({
  title,
  email,
  titleRef,
}: {
  title: string;
  email?: string;
  titleRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <header className="account-header">
      <div className="account-heading">
        <h1 ref={titleRef} tabIndex={titleRef == null ? undefined : -1}>
          {title}
        </h1>
        {email != null && <p>{email}</p>}
      </div>
    </header>
  );
}
