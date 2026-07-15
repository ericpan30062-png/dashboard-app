import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 py-16 dark:bg-black">
      <SignIn />
    </div>
  );
}
