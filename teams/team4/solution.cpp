// team4 — TODO: замените этот файл своим решением.
//
// Вход:  input.txt в текущем каталоге (это же содержимое подаётся на stdin).
// Выход: output.txt в текущем каталоге (или stdout, если файл не создан).
//
// Сборка в CI: g++ -O2 -std=c++17 solution.cpp

#include <fstream>
#include <iostream>

int main() {
    std::ifstream in("input.txt");
    std::ofstream out("output.txt");
    if (!in || !out) {
        std::cerr << "team4: cannot open input.txt/output.txt\n";
        return 1;
    }

    std::cerr << "team4: solution not implemented\n";
    return 1;
}
