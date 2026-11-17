import React from 'react';
import Container from '../../components/layout/Container';
import Card from '../../components/ui/Card';
import SignInPanel from '../../components/auth/SignInPanel';
import { Reveal } from '../../components/ui/motion';

/** Full-page sign-in (the same split-screen panel the header opens as a modal). */
export default function SignIn() {
  return (
    <Container className="py-10 sm:py-16">
      <Reveal>
        <Card padded={false} className="mx-auto max-w-4xl overflow-hidden">
          <SignInPanel />
        </Card>
      </Reveal>
    </Container>
  );
}
