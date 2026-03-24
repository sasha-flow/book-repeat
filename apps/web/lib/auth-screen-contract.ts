export function createAuthScreenContract() {
  return {
    title: getAuthScreenTitle(),
    submitLabel: getAuthScreenSubmitLabel({ loading: false }),
  };
}

export function getAuthScreenTitle() {
  return "Sign in";
}

export function getAuthScreenSubmitLabel({ loading }: { loading: boolean }) {
  return loading ? "Please wait..." : "Sign in";
}

export function isAuthScreenSubmitDisabled({
  email,
  password,
  loading,
}: {
  email: string;
  password: string;
  loading: boolean;
}) {
  return loading || !email || !password;
}
