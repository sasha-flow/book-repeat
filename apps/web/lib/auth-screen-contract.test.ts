import assert from "node:assert/strict";
import test from "node:test";

const {
  createAuthScreenContract,
  getAuthScreenTitle,
  getAuthScreenSubmitLabel,
  isAuthScreenSubmitDisabled,
} = (await import(
  new URL("./auth-screen-contract.ts", import.meta.url).href
)) as typeof import("./auth-screen-contract");

test("auth screen exposes only sign-in copy and action", () => {
  const contract = createAuthScreenContract();

  assert.deepEqual(contract, {
    title: "Sign in",
    submitLabel: "Sign in",
  });
});

test("auth screen title is always sign in", () => {
  assert.equal(getAuthScreenTitle(), "Sign in");
});

test("auth screen submit label is sign in unless loading", () => {
  assert.equal(getAuthScreenSubmitLabel({ loading: false }), "Sign in");
  assert.equal(getAuthScreenSubmitLabel({ loading: true }), "Please wait...");
});

test("auth screen submit stays disabled until both credentials are present", () => {
  assert.equal(
    isAuthScreenSubmitDisabled({
      email: "",
      password: "secret",
      loading: false,
    }),
    true,
  );

  assert.equal(
    isAuthScreenSubmitDisabled({
      email: "reader@example.com",
      password: "",
      loading: false,
    }),
    true,
  );

  assert.equal(
    isAuthScreenSubmitDisabled({
      email: "reader@example.com",
      password: "secret",
      loading: false,
    }),
    false,
  );

  assert.equal(
    isAuthScreenSubmitDisabled({
      email: "reader@example.com",
      password: "secret",
      loading: true,
    }),
    true,
  );
});
