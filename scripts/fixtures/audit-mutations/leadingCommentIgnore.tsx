// audit:ignore missing-local-lock
const leadingCommentIgnore = useMutation({
  onSuccess: (res) => {
    const asId = getMetaActionStateId(res.meta);
    chrome.trackActionState(asId, {
      object: objectRef('Network', 1),
    });
  },
});
