export function RegisteredIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      className="h-5 w-5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-6-6z" />
      <polyline strokeLinecap="round" strokeLinejoin="round" points="9 3 9 9 15 9" />
    </svg>
  );
}

export function ActiveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      className="h-5 w-5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728M18.364 5.636a9 9 0 010 12.728" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.464 15.536a5 5 0 010-7.072M15.536 8.464a5 5 0 010 7.072" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function InactiveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      className="h-5 w-5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-12.728 12.728" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 0112.728 12.728M5.636 5.636A9 9 0 0118.364 18.364" />
    </svg>
  );
}
