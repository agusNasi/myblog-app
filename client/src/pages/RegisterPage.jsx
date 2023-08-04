import axios from 'axios';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [redirect, setRedirect] = useState(false);

  async function register(ev) {
    ev.preventDefault();
    try {
      await axios.post('/register', {
        username,
        password,
        email,
      });
      setRedirect(true);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'registration failed. Try again later',
      });
    }
  }

  if (redirect) {
    return <Navigate to={'/login'} />;
  }

  return (
    <form className="register" onSubmit={register}>
      <h1>Register</h1>
      <input
        type="text"
        placeholder="username"
        value={username}
        onChange={(ev) => setUsername(ev.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(ev) => setEmail(ev.target.value)}
        required
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(ev) => setPassword(ev.target.value)}
        required
      />
      <button>Register</button>
    </form>
  );
}
