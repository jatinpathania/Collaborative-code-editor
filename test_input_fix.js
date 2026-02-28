const { exec } = require('child_process');

const command = `docker run --rm -w /root gcc:latest sh -c "echo 'int main() { return 1; }' > a.c && gcc a.c -o output 2> compile_error.txt && ./output || cat compile_error.txt"`;
exec(command, (err, stdout, stderr) => {
    console.log("ERR:", err);
    console.log("STDOUT:", stdout);
    console.log("STDERR:", stderr);
});
