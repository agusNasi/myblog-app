import { useEffect, useState } from 'react';
import Post from '../Post';
import axios from 'axios';

export default function IndexPage() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    axios.get('/post').then((response) => {
      setPosts(response.data);
    });
  }, []);
  return (
    <>
      {posts.length > 0 &&
        posts.map((post) => <Post {...post} key={post._id} />)}
    </>
  );
}
