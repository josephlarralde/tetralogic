import { Quaternion, Vector3 } from 'three'

export function generateCubeOrientations() {
  const orientations: Quaternion[] = [];
  const seen: Set<string> = new Set();

  // Base 90-degree rotations (the generators)
  const rotX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  const rotY = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

  // Start with the default identity orientation (no rotation)
  const current = new Quaternion();
  
  // Helper function to recursively find all combinations
  function explore(q: Quaternion) {
    // Create a unique string key based on rounded quaternion values
    const key = `
      ${Math.round(q.x * 100)},
      ${Math.round(q.y * 100)},
      ${Math.round(q.z * 100)},
      ${Math.round(q.w * 100)}
    `;
    
    // Negative quaternions represent the exact same rotation (-q = q)
    const altKey = `
      ${Math.round(-q.x * 100)},
      ${Math.round(-q.y * 100)},
      ${Math.round(-q.z * 100)},
      ${Math.round(-q.w * 100)}
    `;

    if (seen.has(key) || seen.has(altKey)) return;

    // Save the unique orientation
    seen.add(key);
    orientations.push(q.clone());

    // Try rotating 90 degrees on X, and 90 degrees on Y
    explore(q.clone().multiplyQuaternions(rotX, q));
    explore(q.clone().multiplyQuaternions(rotY, q));
  }

  explore(current);
  return orientations; // Returns an array of exactly 24 THREE.Quaternion objects
}