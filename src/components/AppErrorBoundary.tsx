import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Box, Button, Container, Stack, Typography } from "@mui/material";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled application render error", error, info);
  }

  private retry = (): void => {
    window.location.reload();
  };

  private goHome = (): void => {
    window.location.assign("/");
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <Container component="main" maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800 }}>
              Something went wrong
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              The page could not be displayed. Your saved data has not been changed by this error screen.
            </Typography>
          </Box>

          <Alert severity="error" role="alert">
            Try reloading the page. If the problem continues, return to the home page and try again later.
          </Alert>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button variant="contained" onClick={this.retry}>
              Reload page
            </Button>
            <Button variant="outlined" onClick={this.goHome}>
              Return home
            </Button>
          </Stack>
        </Stack>
      </Container>
    );
  }
}
