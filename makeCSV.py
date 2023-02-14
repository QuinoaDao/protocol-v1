f_in = open('./console.txt', 'r')
f_out = open('./console.csv', 'w')

cnt1=0
cnt2=0

for line in f_in:
    if "input" in line:
        cnt1 += 1
        continue
    if "output" in line:
        cnt2 += 1
        continue
    if "0" <= line[0] <= "9":
        line = line[:-1] + " " + str(cnt1) + " " + str(cnt2) + "\n"
        cnt1 = 0
        cnt2 = 0

    line = line.replace("0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", "wMatic")
    line = line.replace("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", "wEth")
    line = line.replace("0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7", "ghst")
    line = line.replace("0xB5C064F955D8e7F38fE0460C556a72987494eE17", "quick")
    line = line.replace("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", "usdc")
    line = line.replace(" - ", "-")
    line = line.replace(" ", ",")

    f_out.write(line)

f_in.close()
f_out.close()